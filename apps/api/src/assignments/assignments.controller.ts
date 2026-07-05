import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public } from '../auth/decorators';

export class AssignDto {
  @ApiProperty()
  @IsUUID()
  slotId: string;

  @ApiProperty()
  @IsUUID()
  personId: string;
}

export class DeclineDto {
  @ApiPropertyOptional({ description: 'Optionaler Grund der Absage' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RespondMineDto extends DeclineDto {
  @ApiProperty({ enum: ['ACCEPTED', 'DECLINED'] })
  @IsIn(['ACCEPTED', 'DECLINED'])
  action: 'ACCEPTED' | 'DECLINED';
}

@ApiTags('assignments')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get('suggestions')
  @ApiOperation({
    summary: 'Einteilungs-Vorschläge für einen Slot (Verfügbarkeit + faire Verteilung)',
  })
  suggestions(@CurrentUser() user: AuthUser, @Query('slotId', ParseUUIDPipe) slotId: string) {
    return this.assignments.suggest(user, slotId);
  }

  @Post()
  @ApiOperation({ summary: 'Person einteilen (Admin oder Teamleiter des Slots)' })
  assign(@CurrentUser() user: AuthUser, @Body() dto: AssignDto) {
    return this.assignments.assign(user, dto.slotId, dto.personId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Einteilung entfernen' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.assignments.remove(user, id);
  }
}

// Tokenbasierte Zusage/Absage – ohne Login nutzbar (Link aus der Mail).
// Eng rate-limitiert: der Token-Namensraum ist zwar 128 Bit groß, aber
// Brute-Force soll trotzdem schon am Limit scheitern.
@ApiTags('respond')
@Controller('respond')
export class RespondController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  @ApiOperation({ summary: 'Infos zur Einteilung (nur Vorname + Termin, keine Kontaktdaten)' })
  info(@Param('token') token: string) {
    return this.assignments.tokenInfo(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Zusagen (Token wird entwertet)' })
  accept(@Param('token') token: string) {
    return this.assignments.respondByToken(token, 'ACCEPTED');
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Absagen (Teamleiter werden mit Ersatzvorschlägen informiert)' })
  decline(@Param('token') token: string, @Body() dto: DeclineDto) {
    return this.assignments.respondByToken(token, 'DECLINED', dto.reason);
  }
}

// "Meine Dienste" für eingeloggte Nutzer
@ApiTags('me')
@Controller('me/assignments')
export class MyAssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene anstehende Einteilungen' })
  mine(@CurrentUser() user: AuthUser) {
    return this.assignments.myAssignments(user);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Auf eigene Einteilung antworten (zusagen/absagen)' })
  respond(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondMineDto,
  ) {
    return this.assignments.respondMine(user, id, dto.action, dto.reason);
  }
}
