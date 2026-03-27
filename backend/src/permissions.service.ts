import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { parseISO } from 'date-fns';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getPermissions(weekStart: string) {
    const date = parseISO(weekStart);
    return this.prisma.permission.findMany({
      where: { weekStart: date },
      include: {
        member: { select: { id: true, name: true, voice: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPermission(
    memberId: number,
    sessionType: string,
    weekStart: string,
    reason: string | undefined,
    grantedBy: string,
  ) {
    const date = parseISO(weekStart);
    try {
      return await this.prisma.permission.create({
        data: { memberId, sessionType, weekStart: date, reason, grantedBy },
        include: {
          member: { select: { id: true, name: true, voice: true } },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'Ya existe un permiso para este miembro en esta semana y tipo de sesión',
        );
      }
      throw e;
    }
  }

  async deletePermission(id: number) {
    return this.prisma.permission.delete({ where: { id } });
  }
}
