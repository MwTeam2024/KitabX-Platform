import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { OAuthService } from './oauth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpService, SmsService, EmailService, OAuthService],
  // OtpService/OAuthService are reused by AdminModule for admin login (§21).
  exports: [AuthService, OtpService, OAuthService],
})
export class AuthModule {}
