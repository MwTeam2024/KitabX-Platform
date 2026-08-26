/**
 * Applies Nest's parameter decorators (@Body, @Param, @Query, @Req, @Res, ...)
 * as a METHOD decorator instead of parameter-position syntax.
 *
 * Why this exists: this backend is plain JavaScript compiled with Babel's
 * *legacy* decorator transform (TypeScript isn't used anywhere — see
 * jsconfig.json, not tsconfig.json). That transform fully supports decorators
 * on classes, methods and properties, but its parser has no grammar for a
 * decorator written directly before a function parameter — `find(@Param('id') id)`
 * fails to parse with a SyntaxError. `@Body()`/`@Param()`/etc. are themselves
 * just plain functions Nest exports (`Body()` returns `(target, key, index) => {...}`),
 * so calling them manually at the right parameter index produces the exact
 * same metadata Nest's router reads at request time — verified against a real
 * running server, not just inspected metadata.
 *
 * Usage:
 *   @Get(':id')
 *   @Params({ 0: Param('id') })
 *   findOne(id) { ... }
 *
 *   @Post()
 *   @Params({ 0: Body(), 1: CurrentUser() })
 *   create(body, user) { ... }
 */
export function Params(map) {
  return (target, key, descriptor) => {
    Object.entries(map).forEach(([index, decorate]) => decorate(target, key, Number(index)));
    return descriptor;
  };
}
