import type { Types } from "mongoose";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

export async function notifyUser(params: {
  userId: Types.ObjectId | string;
  type: string;
  message: string;
  link?: string;
}): Promise<void> {
  await Notification.create({
    userId: params.userId,
    type: params.type,
    message: params.message,
    link: params.link,
  });
}

export async function getAdmins(): Promise<Array<{ _id: Types.ObjectId; name: string; email: string }>> {
  return User.find({ role: "admin", status: "approved" }).select("_id name email").lean();
}

export async function notifyAllAdmins(params: {
  type: string;
  message: string;
  link?: string;
}): Promise<void> {
  const admins = await User.find({ role: "admin", status: "approved" }).select("_id").lean();
  if (admins.length === 0) return;
  await Notification.insertMany(
    admins.map((admin) => ({
      userId: admin._id,
      type: params.type,
      message: params.message,
      link: params.link,
    }))
  );
}
