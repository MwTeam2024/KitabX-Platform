import { Body, Controller, Dependencies, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from './admin-auth.guard';
import { required } from '../common/validate';
import { AdminService } from './admin.service';
import { SocietiesService } from '../societies/societies.service';
import { ReportsService } from '../reports/reports.service';

@Dependencies(AdminService, SocietiesService, ReportsService)
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(admin, societies, reports) {
    this.admin = admin;
    this.societies = societies;
    this.reports = reports;
  }

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('notification-counts')
  @Params({
    0: Query('usersSince'), 1: Query('reportsSince'), 2: Query('moderationSince'), 3: Query('deletionRequestsSince'),
    4: Query('locationRequestsSince'),
  })
  notificationCounts(usersSince, reportsSince, moderationSince, deletionRequestsSince, locationRequestsSince) {
    return this.admin.notificationCounts({
      usersSince, reportsSince, moderationSince, deletionRequestsSince, locationRequestsSince,
    });
  }

  // ---- users ----

  @Get('users')
  @Params({ 0: Query('q') })
  listUsers(q) {
    return this.admin.listUsers({ q });
  }

  @Patch('users/:id/verification')
  @Params({ 0: Param('id'), 1: Body() })
  setVerification(id, body) {
    required(body, ['verified']);
    return this.admin.setVerification(id, !!body.verified);
  }

  @Patch('users/:id/suspension')
  @Params({ 0: Param('id'), 1: Body(), 2: CurrentAdmin('id') })
  setSuspended(id, body, adminId) {
    required(body, ['suspended']);
    return this.admin.setSuspended(id, !!body.suspended, adminId);
  }

  @Post('users/:id/approve')
  @Params({ 0: Param('id') })
  approve(id) {
    return this.admin.approveUser(id);
  }

  @Post('users/:id/reject')
  @Params({ 0: Param('id') })
  reject(id) {
    return this.admin.rejectUser(id);
  }

  // ---- account deletion requests ----

  @Get('deletion-requests')
  listDeletionRequests() {
    return this.admin.listDeletionRequests();
  }

  @Post('deletion-requests/:id/action')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  actionDeletionRequest(id, adminId) {
    return this.admin.actionDeletionRequest(id, adminId);
  }

  @Post('deletion-requests/:id/reject')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  rejectDeletionRequest(id, adminId) {
    return this.admin.rejectDeletionRequest(id, adminId);
  }

  // ---- societies (delegates to SocietiesService) ----

  @Get('societies')
  listSocieties() {
    return this.societies.listSocieties();
  }

  @Post('societies')
  @Params({ 0: Body() })
  createSociety(body) {
    required(body, ['name', 'cityName']);
    return this.societies.adminCreateSociety(body);
  }

  @Patch('societies/:id')
  @Params({ 0: Param('id'), 1: Body() })
  updateSociety(id, body) {
    return this.societies.adminUpdateSociety(id, body);
  }

  @Delete('societies/:id')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  removeSociety(id, adminId) {
    return this.admin.removeSociety(id, adminId);
  }

  // ---- location requests (city/society a member asked to add) ----

  @Get('location-requests')
  listLocationRequests() {
    return this.admin.listLocationRequests();
  }

  @Post('location-requests/:id/approve')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  approveLocationRequest(id, adminId) {
    return this.admin.approveLocationRequest(id, adminId);
  }

  @Post('location-requests/:id/reject')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id'), 2: Body() })
  rejectLocationRequest(id, adminId, body) {
    return this.admin.rejectLocationRequest(id, adminId, body?.reason);
  }

  // ---- listings ----

  @Get('listings/flagged')
  listFlagged() {
    return this.admin.listFlaggedListings();
  }

  @Get('users/flagged')
  listFlaggedUsers() {
    return this.admin.listFlaggedUsers();
  }

  @Delete('listings/:id')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  removeListing(id, adminId) {
    return this.admin.removeListing(id, adminId);
  }

  // ---- exchanges ----

  @Get('exchanges')
  listExchanges() {
    return this.admin.listExchanges();
  }

  // ---- credits ----

  @Get('credits/ledger')
  creditsLedger() {
    return this.admin.creditsLedger();
  }

  @Post('credits/correction')
  @Params({ 0: Body(), 1: CurrentAdmin('id') })
  correctCredit(body, adminId) {
    required(body, ['userId', 'amount', 'reason']);
    return this.admin.correctCredit(body.userId, Number(body.amount), body.reason, adminId);
  }

  // ---- reports ----

  @Get('reports')
  @Params({ 0: Query('status') })
  reports_(status) {
    return this.admin.reports(status);
  }

  @Post('reports/:id/resolve')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id'), 2: Body() })
  resolveReport(id, adminId, body) {
    return this.reports.adminResolve(id, adminId, body?.notes);
  }

  @Post('support-requests/:id/resolve')
  @Params({ 0: Param('id'), 1: CurrentAdmin('id') })
  resolveSupportRequest(id, adminId) {
    return this.admin.resolveSupportRequest(id, adminId);
  }

  // ---- settings ----

  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Patch('settings')
  @Params({ 0: CurrentAdmin('id'), 1: Body() })
  updateSettings(adminId, body) {
    return this.admin.updateSettings(adminId, body);
  }
}
