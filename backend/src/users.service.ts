import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, role: true },
      orderBy: { username: 'asc' },
    });
  }

  async create(username: string, password: string, role: string) {
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { username, password: hashed, role },
      select: { id: true, username: true, role: true },
    });
  }

  update(id: number, username?: string, role?: string) {
    const data: Record<string, string> = {};
    if (username !== undefined) data.username = username;
    if (role !== undefined) data.role = role;
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true },
    });
  }

  async updatePassword(id: number, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
    return { updated: true };
  }

  async remove(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new ForbiddenException('No puedes eliminar tu propio usuario');
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
