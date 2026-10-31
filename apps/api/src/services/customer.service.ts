import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  adminCustomerListQuerySchema,
  CustomerUpdateInput,
  Paginated,
} from "@catafy/types";
import { Types, type PipelineStage } from "mongoose";
import type { z } from "zod";
import { AppError } from "../lib/errors.js";
import { escapeRegex, phoneSearchDigits } from "../lib/search.js";
import { Customer, type CustomerDoc } from "../models/index.js";

type ListQuery = z.output<typeof adminCustomerListQuerySchema>;
type WithStats = CustomerDoc & {
  _id: Types.ObjectId;
  createdAt: Date;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

/** Order count, spend (cancelled orders excluded) and last order date, computed from orders. */
const ORDER_STATS: PipelineStage[] = [
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "customerId",
      as: "orders",
      pipeline: [{ $project: { status: 1, total: 1, createdAt: 1 } }],
    },
  },
  {
    $addFields: {
      orderCount: { $size: "$orders" },
      totalSpent: {
        $sum: {
          $map: {
            input: "$orders",
            as: "o",
            in: { $cond: [{ $eq: ["$$o.status", "CANCELLED"] }, 0, "$$o.total"] },
          },
        },
      },
      lastOrderAt: { $max: "$orders.createdAt" },
    },
  },
  { $project: { orders: 0 } },
];

function toSummary(c: WithStats): AdminCustomerSummary {
  return {
    id: c._id.toString(),
    name: c.name,
    phone: c.phone,
    city: c.lastAddress?.city ?? "",
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
    lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
  };
}

export async function listCustomers(query: ListQuery): Promise<Paginated<AdminCustomerSummary>> {
  const match: Record<string, unknown> = {};
  if (query.q) {
    const or: Record<string, unknown>[] = [{ name: new RegExp(escapeRegex(query.q), "i") }];
    const digits = phoneSearchDigits(query.q);
    if (digits) or.push({ phone: new RegExp(digits) });
    match.$or = or;
  }

  const [result] = await Customer.aggregate<{ items: WithStats[]; total: { n: number }[] }>([
    { $match: match },
    ...ORDER_STATS,
    {
      $facet: {
        items: [
          { $sort: { lastOrderAt: -1, _id: -1 } },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const total = result?.total[0]?.n ?? 0;
  return {
    items: (result?.items ?? []).map(toSummary),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getCustomer(id: string): Promise<AdminCustomerDetail> {
  const [c] = await Customer.aggregate<WithStats>([
    { $match: { _id: new Types.ObjectId(id) } },
    ...ORDER_STATS,
  ]);
  if (!c) throw AppError.notFound("Customer not found");
  const a = c.lastAddress;
  return {
    ...toSummary(c),
    notes: c.notes,
    lastAddress: a
      ? {
          name: a.name,
          phone: a.phone,
          line1: a.line1,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
        }
      : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function updateCustomer(
  id: string,
  input: CustomerUpdateInput,
): Promise<AdminCustomerDetail> {
  const { matchedCount } = await Customer.updateOne({ _id: id }, { $set: input });
  if (matchedCount === 0) throw AppError.notFound("Customer not found");
  return getCustomer(id);
}
