import {inject, injectable} from 'inversify';
import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';

import {
  BaseController,
  HttpMethod,
  HttpError,
  UploadFileMiddleware,
  ValidateDtoMiddleware,
  ValidateObjectIdMiddleware,
  DocumentExistsMiddleware,
} from '../../libs/rest/index.js';
import {Logger} from '../../libs/logger/index.js';
import {Component} from '../../enum/index.js';
import {Config, RestSchema} from '../../libs/config/index.js';
import {fillDTO} from '../../helpers/index.js';
import {CreateUserRequest} from './create-user-request.type.js';
import {LoginUserDTO} from './dto/login-user.dto.js';
import {UserService} from './user-service.interface.js';
import {UserRDO} from './rdo/user.rdo.js';
import {CreateUserDTO} from './dto/create-user.dto.js';
import {LoginUserRequest} from './login-user-request.type.js';

@injectable()
export class UserController extends BaseController {
  constructor(
    @inject(Component.Logger) protected readonly logger: Logger,
    @inject(Component.UserService) private readonly userService: UserService,
    @inject(Component.Config) private readonly configService: Config<RestSchema>,
  ) {
    super(logger);

    this.logger.info('Register routes for OfferController...');

    this.addRoute({
      path: '/register', method: HttpMethod.Post,
      handler: this.create,
      middlewares: [
        new ValidateDtoMiddleware(CreateUserDTO),
      ]
    });
    this.addRoute({
      path: '/login',
      method: HttpMethod.Post,
      handler: this.login,
      middlewares: [
        new ValidateDtoMiddleware(LoginUserDTO),
        new DocumentExistsMiddleware(this.userService, 'User', 'userId ')
      ]
    });
    this.addRoute({
      path: '/:userId/avatar',
      method: HttpMethod.Post,
      handler: this.uploadAvatar,
      middlewares: [
        new ValidateObjectIdMiddleware('userId'),
        new UploadFileMiddleware(
          this.configService.get('UPLOAD_DIRECTORY'),
          'avatar'
        )
      ]
    });
    this.addRoute({ path: '/login', method: HttpMethod.Get, handler: this.index });
    this.addRoute({ path: '/logout', method: HttpMethod.Get, handler: this.logout });
  }

  public index(_req: Request, _res: Response): void {
    // Код обработчика
  }

  public async create(
    { body }: CreateUserRequest,
    res: Response,
  ): Promise<void> {
    const existsUser = await this.userService.findByEmail(body.email);

    if (existsUser) {
      throw new HttpError(
        StatusCodes.CONFLICT,
        `User with email «${body.email}» exists.`,
        'UserController'
      );
    }

    const result = await this.userService.create(body, this.configService.get('SALT'));
    this.created(res, fillDTO(UserRDO, result));
  }

  public async login(
    { body }: LoginUserRequest,
    _res: Response,
  ): Promise<void> {
    const existsUser = await this.userService.findByEmail(body.email);

    if (! existsUser) {
      throw new HttpError(
        StatusCodes.UNAUTHORIZED,
        `User with email ${body.email} not found.`,
        'UserController',
      );
    }

    throw new HttpError(
      StatusCodes.NOT_IMPLEMENTED,
      'Not implemented',
      'UserController',
    );
  }

  public async logout(_req: Request, _res: Response): Promise<void> {
    throw new HttpError(
      StatusCodes.NOT_IMPLEMENTED,
      'Not implemented',
      'UserController',
    );
  }

  public async uploadAvatar(req: Request, res: Response) {
    this.created(res, {
      filepath: req.file?.path
    });
  }
}
