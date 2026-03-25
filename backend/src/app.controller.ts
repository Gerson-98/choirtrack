import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from './auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Post('auth/login')
  async login(@Body() body: any) {
    return this.appService.login(body.username, body.password);
  }

  @UseGuards(AuthGuard)
  @Get('members')
  async getMembers() {
    return this.appService.getMembers();
  }

  // Sesión de hoy (compatibilidad)
  @UseGuards(AuthGuard)
  @Get('sessions/today')
  async getTodaySession(@Request() req: any) {
    return this.appService.getTodaySession(req.user.role);
  }

  // Sesión por fecha: GET /sessions/date/2025-03-24?type=am_prayer
  // createIfNotExists=false → no crea sesión vacía si no existe
  @UseGuards(AuthGuard)
  @Get('sessions/date/:date')
  async getSessionByDate(
    @Request() req: any,
    @Param('date') date: string,
    @Query('type') type?: string,
  ) {
    return this.appService.getSession(type || req.user.role, date, false);
  }

  // Toggle individual (mantener compatibilidad)
  @UseGuards(AuthGuard)
  @Post('attendance')
  async toggleAttendance(
    @Body() body: { memberId: number; sessionId: number },
  ) {
    return this.appService.toggleAttendance(body.memberId, body.sessionId);
  }

  // Guardar asistencia completa de una sesión (nuevo — flujo de confirmación)
  @UseGuards(AuthGuard)
  @Post('attendance/save')
  async saveAttendance(
    @Request() req: any,
    @Body() body: { sessionId: number; presentMemberIds: number[] },
  ) {
    return this.appService.saveAttendance(
      body.sessionId,
      body.presentMemberIds,
      req.user.username,
    );
  }

  @UseGuards(AuthGuard)
  @Get('eligibility/:date')
  async getEligibility(@Param('date') date: string) {
    return this.appService.getEligibility(date);
  }

  @UseGuards(AuthGuard)
  @Get('director/today')
  async getDirectorToday() {
    return this.appService.getDirectorToday();
  }

  @UseGuards(AuthGuard)
  @Get('director/week')
  async getDirectorWeek(@Query('date') date: string) {
    // Fallback: fecha de hoy en Guatemala (UTC-6) para evitar desfase por zona horaria
    const dateStr = date || new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
    return this.appService.getDirectorWeek(dateStr);
  }

  @UseGuards(AuthGuard)
  @Get('audit/week')
  async getAuditWeek(@Request() req: any, @Query('date') date: string) {
    if (req.user.role !== 'director') throw new UnauthorizedException();
    const dateStr = date || new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
    return this.appService.getAuditLog(dateStr);
  }
}