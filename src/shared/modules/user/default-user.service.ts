import {DocumentType, types} from '@typegoose/typegoose';
import {inject, injectable} from 'inversify';

import {UserService} from './user-service.interface.js';
import {UserEntity} from './user.entity.js';
import {CreateUserDTO} from './dto/create-user.dto.js';
import {Component} from '../../enum/index.js';
import {Logger} from '../../libs/logger/index.js';

@injectable()
export class DefaultUserService implements UserService {
  constructor(
    @inject(Component.Logger) private readonly logger: Logger,
    @inject(Component.UserModel) private readonly userModel: types.ModelType<UserEntity>
  ){}

  public async create(dto: CreateUserDTO, salt: string): Promise<DocumentType<UserEntity>> {
    const user = new UserEntity(dto);
    user.setPassword(dto.password, salt);

    const result = await this.userModel.create(user);
    this.logger.info(`New user created: ${user.email}`);

    return result;
  }

  public async findByEmail(email: string): Promise<DocumentType<UserEntity> | null> {
    return this.userModel
      .findOne({email})
      .populate(['favoriteOffers'])
      .exec();
  }

  public async findOrCreate(dto: CreateUserDTO, salt: string): Promise<DocumentType<UserEntity>> {
    const existedUser = await this.findByEmail(dto.email);

    if(existedUser) {
      return existedUser.populate(['favoriteOffers']);
    }

    return this.create(dto, salt);
  }

  public async exists(documentId: string): Promise<boolean> {
    return (await this.userModel
      .exists({_id: documentId})) !== null;
  }
}
