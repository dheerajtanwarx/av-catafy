import mongoose from "mongoose";
import type { Logger } from "pino";

export interface DbOptions {
  uri: string;
  dbName: string;
  autoIndex: boolean;
}

export async function connectDb(
  { uri, dbName, autoIndex }: DbOptions,
  logger: Logger,
): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName, autoIndex, serverSelectionTimeoutMS: 10_000 });

  // Order creation relies on multi-document transactions, which need a replica set (Atlas always is).
  const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
  if (hello && !hello.setName && hello.msg !== "isdbgrid") {
    logger.warn(
      "MongoDB is a standalone server: transactions will fail. Use Atlas or start mongod with --replSet.",
    );
  }
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
