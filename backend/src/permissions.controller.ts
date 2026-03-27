import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { AuthGuard } from './auth.guard';

@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  getPermissions(@Query('weekStart') weekStart: string) {
    return this.permissionsService.getPermissions(weekStart);
  }

  @Post()
  createPermission(
    @Request() req: any,
    @Body()
    body: {
      memberId: number;
      sessionType: string;
      weekStart: string;
      reason?: string;
    },
  ) {
    return this.permissionsService.createPermission(
      body.memberId,
      body.sessionType,
      body.weekStart,
      body.reason,
      req.user.username,
    );
  }

  @Delete(':id')
  deletePermission(@Param('id') id: string) {
    return this.permissionsService.deletePermission(Number(id));
  }
}
