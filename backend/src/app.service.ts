import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { startOfWeek, endOfWeek, parseISO } from 'date-fns';

// Guatemala es UTC-6 fijo (no cambia por horario de verano).
// Retorna un Date cuya fecha UTC coincide con la fecha local actual en Guatemala.
function toGuatemalaDate(date: Date = new Date()): Date {
  const offset = -6 * 60; // minutos
  const local = new Date(date.getTime() + offset * 60 * 1000);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

@Injectable()
export class AppService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async login(username: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException();
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException();
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      role: user.role,
    };
  }

  // Orden de voces para mostrar en UI
  private readonly VOICE_ORDER: Record<string, number> = {
    soprano: 1,
    segunda: 2,
    tenor: 3,
    bajo: 4,
  };

  async getMembers() {
    const members = await this.prisma.member.findMany();
    return members.sort((a, b) => {
      const va = this.VOICE_ORDER[a.voice] ?? 99;
      const vb = this.VOICE_ORDER[b.voice] ?? 99;
      if (va !== vb) return va - vb;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  // Sesión para una fecha específica (o hoy si no se pasa fecha).
  // createIfNotExists=false → solo busca, no crea (para GET sin side effects).
  async getSession(role: string, dateString?: string, createIfNotExists = true) {
    const targetDate = dateString
      ? parseISO(dateString)
      : toGuatemalaDate();

    let session = await this.prisma.session.findUnique({
      where: { date_type: { date: targetDate, type: role } },
      include: { attendances: true },
    });

    if (!session && createIfNotExists) {
      session = await this.prisma.session.create({
        data: { date: targetDate, type: role },
        include: { attendances: true },
      });
    }

    if (!session) {
      return { id: null, date: targetDate, type: role, attendances: [], updatedAt: null, lastSavedBy: null };
    }

    // updatedAt: campo @updatedAt del schema; si aún es null, derivar de attendances
    const updatedAt = session.updatedAt ?? (
      session.attendances.length > 0
        ? new Date(Math.max(...session.attendances.map((a) => a.updatedAt.getTime())))
        : null
    );

    return { ...session, updatedAt };
  }

  // Mantener compatibilidad con el endpoint /sessions/today
  async getTodaySession(role: string) {
    return this.getSession(role);
  }

  // savedBy: username del usuario que guarda (extraído del JWT en el controller)
  async saveAttendance(
    sessionId: number,
    presentMemberIds: number[],
    savedBy: string,
  ) {
    // Obtener todos los miembros
    const allMembers = await this.prisma.member.findMany({ select: { id: true } });

    // Para cada miembro, upsert con el valor correcto
    await Promise.all(
      allMembers.map((m) => {
        const isPresent = presentMemberIds.includes(m.id);
        return this.prisma.attendanceRecord.upsert({
          where: { memberId_sessionId: { memberId: m.id, sessionId } },
          update: { isPresent },
          create: { memberId: m.id, sessionId, isPresent },
        });
      }),
    );

    // Actualizar lastSavedBy — también dispara @updatedAt en Session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastSavedBy: savedBy },
    });

    return { saved: true, presentCount: presentMemberIds.length };
  }

  async toggleAttendance(memberId: number, sessionId: number) {
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { memberId_sessionId: { memberId, sessionId } },
    });

    if (existing) {
      return this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { isPresent: !existing.isPresent },
      });
    } else {
      return this.prisma.attendanceRecord.create({
        data: { memberId, sessionId, isPresent: true },
      });
    }
  }

  async getEligibility(dateString: string) {
    const date = parseISO(dateString);
    // Semana de domingo a sábado
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const end = endOfWeek(date, { weekStartsOn: 0 });

    // Permisos de esta semana
    const permRecords = await this.prisma.permission.findMany({
      where: { weekStart: start },
      select: { memberId: true, sessionType: true },
    });

    const permMap = new Map<number, Set<string>>();
    for (const p of permRecords) {
      if (!permMap.has(p.memberId)) permMap.set(p.memberId, new Set());
      permMap.get(p.memberId)!.add(p.sessionType);
    }

    const members = await this.prisma.member.findMany({
      include: {
        attendances: {
          where: {
            session: { date: { gte: start, lte: end } },
            isPresent: true,
          },
          include: { session: true },
        },
      },
    });

    // Ordenar por voz
    const ordered = members.sort((a, b) => {
      const va = this.VOICE_ORDER[a.voice] ?? 99;
      const vb = this.VOICE_ORDER[b.voice] ?? 99;
      if (va !== vb) return va - vb;
      return a.name.localeCompare(b.name, 'es');
    });

    return ordered.map((member) => {
      let amCount = 0;
      let pmCount = 0;
      let morningCount = 0;
      let rehearsalCount = 0;

      member.attendances.forEach((att) => {
        if (att.session.type === 'am_prayer') amCount++;
        if (att.session.type === 'pm_prayer') pmCount++;
        if (att.session.type === 'morning_prayer') morningCount++;
        if (att.session.type === 'rehearsal') rehearsalCount++;
      });

      const memberPerms = permMap.get(member.id) ?? new Set<string>();
      const hasAmPerm = memberPerms.has('am_prayer');
      const hasPmPerm = memberPerms.has('pm_prayer');
      const hasMorningPerm = memberPerms.has('morning_prayer');
      const hasRehearsalPerm = memberPerms.has('rehearsal');

      // ── Regla unificada (igual para hombres y mujeres) ──────
      // Req1 — 5am estricto: am_prayer >= 2 (o permiso am)
      const req1Met = hasAmPerm || amCount >= 2;

      // Req2 — Total oraciones >= 6: am + pm + morning
      //   cada permiso pm/morning cuenta como +1 asistencia excusada
      const totalPrayerCount =
        amCount + pmCount + morningCount +
        (hasPmPerm ? 1 : 0) +
        (hasMorningPerm ? 1 : 0);
      const req2Met = totalPrayerCount >= 6;

      // Req3 — Ensayos >= 2 (o permiso)
      const req3Met = hasRehearsalPerm || rehearsalCount >= 2;

      const isEligible = req1Met && req2Met && req3Met;

      return {
        member: { id: member.id, name: member.name, voice: member.voice, gender: member.gender },
        counts: {
          am: amCount,
          pm: pmCount,
          morning: morningCount,
          rehearsal: rehearsalCount,
          total: amCount + pmCount + morningCount,
        },
        permissions: {
          am_prayer: hasAmPerm,
          pm_prayer: hasPmPerm,
          morning_prayer: hasMorningPerm,
          rehearsal: hasRehearsalPerm,
        },
        isEligible,
      };
    });
  }

  // Reporte semanal: conteo de sesiones guardadas + datos de elegibilidad por miembro
  async getWeekReport(dateString: string) {
    const date = parseISO(dateString);
    const wStart = startOfWeek(date, { weekStartsOn: 0 });
    const wEnd = endOfWeek(date, { weekStartsOn: 0 });

    // Sesiones que fueron guardadas (lastSavedBy != null) esta semana
    const sessions = await this.prisma.session.findMany({
      where: {
        date: { gte: wStart, lte: wEnd },
        lastSavedBy: { not: null },
      },
      select: { type: true },
    });

    const sessionCounts: Record<string, number> = {
      am_prayer: 0,
      pm_prayer: 0,
      morning_prayer: 0,
      rehearsal: 0,
    };
    for (const s of sessions) {
      if (s.type in sessionCounts) sessionCounts[s.type]++;
    }

    const members = await this.getEligibility(dateString);

    const fmt = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return {
      weekStart: fmt(wStart),
      weekEnd: fmt(wEnd),
      sessionCounts,
      members,
    };
  }

  // Vista del director: resumen de la semana completa
  async getDirectorWeek(dateString: string) {
    const date = parseISO(dateString);
    // Calcular domingo de la semana y normalizar a medianoche UTC explícita
    const weekStartLocal = startOfWeek(date, { weekStartsOn: 0 });
    const weekStart = new Date(Date.UTC(
      weekStartLocal.getUTCFullYear(),
      weekStartLocal.getUTCMonth(),
      weekStartLocal.getUTCDate(),
    ));
    // Fin exclusivo (domingo siguiente a medianoche UTC)
    const weekEnd = new Date(Date.UTC(
      weekStartLocal.getUTCFullYear(),
      weekStartLocal.getUTCMonth(),
      weekStartLocal.getUTCDate() + 7,
    ));
    const totalMembers = await this.prisma.member.count();

    // Una sola query para todas las sesiones de la semana
    const sessions = await this.prisma.session.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        type: { in: ['am_prayer', 'pm_prayer', 'morning_prayer', 'rehearsal'] },
      },
      include: { attendances: { where: { isPresent: true } } },
    });

    const sessionMap = new Map<string, number>();
    for (const s of sessions) {
      const y = s.date.getUTCFullYear();
      const m = String(s.date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(s.date.getUTCDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}:${s.type}`;
      sessionMap.set(key, s.attendances.length);
    }

    const REHEARSAL_DAYS = [1, 3, 6]; // lun, mié, sáb

    const days = Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(Date.UTC(
        weekStart.getUTCFullYear(),
        weekStart.getUTCMonth(),
        weekStart.getUTCDate() + i,
      ));
      const y = dayDate.getUTCFullYear();
      const m = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dayDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dow = dayDate.getUTCDay();
      const rehearsalApplies = REHEARSAL_DAYS.includes(dow);

      const getCount = (type: string): number | null =>
        sessionMap.has(`${dateStr}:${type}`)
          ? sessionMap.get(`${dateStr}:${type}`)!
          : null;

      return {
        date: dateStr,
        dayOfWeek: dow,
        am_prayer: getCount('am_prayer'),
        pm_prayer: getCount('pm_prayer'),
        morning_prayer: getCount('morning_prayer'),
        rehearsal: rehearsalApplies ? getCount('rehearsal') : ('N/A' as const),
      };
    });

    return { days, total: totalMembers };
  }

  // Vista del director: todas las sesiones de hoy + conteos
  async getDirectorToday() {
    const today = toGuatemalaDate();
    const sessionTypes = ['am_prayer', 'pm_prayer', 'morning_prayer', 'rehearsal'];
    const totalMembers = await this.prisma.member.count();

    const sessions = await Promise.all(
      sessionTypes.map(async (type) => {
        const session = await this.prisma.session.findUnique({
          where: { date_type: { date: today, type } },
          include: { attendances: { where: { isPresent: true } } },
        });
        const count = session?.attendances?.length ?? 0;
        return {
          type,
          sessionId: session?.id ?? null,
          count,
          total: totalMembers,
        };
      }),
    );

    return { sessions, date: today };
  }

  async getAuditLog(dateString: string) {
    const date = parseISO(dateString);
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

    const sessions = await this.prisma.session.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      select: {
        id: true,
        date: true,
        type: true,
        updatedAt: true,
        lastSavedBy: true,
        attendances: {
          where: { isPresent: true },
          select: { memberId: true },
        },
      },
      orderBy: [{ date: 'desc' }, { type: 'asc' }],
    });

    return sessions.map((s) => ({
      date: s.date,
      type: s.type,
      presentCount: s.attendances.length,
      lastSavedBy: s.lastSavedBy,
      updatedAt: s.updatedAt,
    }));
  }
}
