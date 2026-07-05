import { Module } from '@nestjs/common';
import {
  AssignmentsController,
  MyAssignmentsController,
  RespondController,
} from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AvailabilityModule],
  controllers: [AssignmentsController, RespondController, MyAssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
