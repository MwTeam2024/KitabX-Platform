import { Body, Controller, Dependencies, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { ReportsService } from './reports.service';

@Dependencies(ReportsService)
@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(reports) {
    this.reports = reports;
  }

  @Post('reports')
  @Params({ 0: CurrentUser('id'), 1: Body() })
  create(reporterId, body) {
    required(body, ['reason']);
    return this.reports.create(reporterId, body);
  }

  @Post('support-requests')
  @Params({ 0: CurrentUser('id'), 1: Body() })
  support(userId, body) {
    required(body, ['description']);
    return this.reports.createSupportRequest(userId, body);
  }
}
