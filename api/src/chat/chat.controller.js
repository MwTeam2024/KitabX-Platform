import { Body, Controller, Delete, Dependencies, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { ChatService } from './chat.service';

@Dependencies(ChatService)
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(chat) {
    this.chat = chat;
  }

  @Get('threads')
  @Params({ 0: CurrentUser('id') })
  listThreads(userId) {
    return this.chat.listThreads(userId);
  }

  @Get('quick-replies')
  quickReplies() {
    return this.chat.quickReplies();
  }

  @Get('threads/:conversationId/messages')
  @Params({ 0: Param('conversationId'), 1: CurrentUser('id') })
  getMessages(conversationId, userId) {
    return this.chat.getMessages(conversationId, userId);
  }

  /** REST fallback for sending — the Socket.IO gateway is the live path
   * (chat.gateway.js) but this keeps chat functional even if a socket
   * connection hasn't been established yet. */
  @Post('threads/:conversationId/messages')
  @Params({ 0: Param('conversationId'), 1: CurrentUser('id'), 2: Body() })
  send(conversationId, userId, body) {
    required(body, ['content']);
    return this.chat.sendMessage(conversationId, userId, body.content);
  }

  /** "Delete for me" — the other participant keeps their own copy of the thread. */
  @Delete('threads/:conversationId')
  @Params({ 0: Param('conversationId'), 1: CurrentUser('id') })
  deleteThread(conversationId, userId) {
    return this.chat.deleteThread(conversationId, userId);
  }
}
