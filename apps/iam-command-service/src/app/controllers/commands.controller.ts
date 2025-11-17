import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';

/**
 * Commands Controller - Write Side Endpoints
 *
 * Example endpoint for command execution.
 * In MVP, this will call command handlers from @ecoma-io/iam-command-interactor
 */
@Controller('commands')
export class CommandsController {
  /**
   * Example: Register a new user
   * POST /commands/register-user
   *
   * TODO: Wire to RegisterUserHandler from iam-command-interactor
   */
  @Post('register-user')
  @HttpCode(HttpStatus.ACCEPTED)
  async registerUser(@Body() body: { email: string; name: string }) {
    // TODO: Inject and call RegisterUserHandler
    // const command = new RegisterUserCommand(body.email, body.name);
    // const result = await this.commandHandler.execute(command);
    // return { userId: result.userId, streamVersion: result.version };

    return {
      message: 'Command accepted (placeholder)',
      email: body.email,
      name: body.name,
    };
  }
}
