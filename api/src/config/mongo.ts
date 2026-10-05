import mongoose from 'mongoose';

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/movieweb';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
