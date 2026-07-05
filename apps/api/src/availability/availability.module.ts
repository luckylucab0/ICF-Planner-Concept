import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

// Modul 7 ergänzt hier die Self-Service-Endpoints für Abwesenheiten;
// der Service wird schon jetzt von der Vorschlags-Engine genutzt.
@Module({
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
