import { Request, Response, NextFunction } from 'express';
import { getProfile, updateProfile } from '../services/profile.service';

export async function getProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await getProfile(req.user!.userId);
    res.json(profile);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

export async function updateProfileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, bio, phoneNumber, dateOfBirth, city, country, profileImage, heightCm, weightKg, preferredPosition } = req.body;
    const updated = await updateProfile(req.user!.userId, {
      firstName, lastName, bio, phoneNumber, dateOfBirth, city, country, profileImage,
      heightCm: heightCm !== undefined ? (heightCm === null ? null : Number(heightCm)) : undefined,
      weightKg: weightKg !== undefined ? (weightKg === null ? null : Number(weightKg)) : undefined,
      preferredPosition,
    });
    res.json(updated);
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}
