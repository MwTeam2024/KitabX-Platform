import { createParamDecorator } from '@nestjs/common';

/** The authenticated admin, attached to `req.admin` by AdminAuthGuard. */
export const CurrentAdmin = createParamDecorator((data, ctx) => {
  const req = ctx.switchToHttp().getRequest();
  return data ? req.admin?.[data] : req.admin;
});
