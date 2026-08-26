import { createParamDecorator } from '@nestjs/common';

/**
 * The authenticated user, attached to `req.user` by JwtAuthGuard.
 * Combine with the `Params()` method-decorator helper — see params.decorator.js
 * for why this can't be written as `@CurrentUser() user` in the parameter list.
 */
export const CurrentUser = createParamDecorator((data, ctx) => {
  const req = ctx.switchToHttp().getRequest();
  return data ? req.user?.[data] : req.user;
});
