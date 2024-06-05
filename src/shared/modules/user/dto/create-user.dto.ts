import {
  IsEnum,
  MaxLength,
  MinLength,
  IsEmail,
  IsMimeType,
} from 'class-validator';

import {UserType} from '../../../enum/index.js';
import {UserValidationMessage} from './user-validation.message.js';

export class CreateUserDTO {
  @IsEmail({}, {message: UserValidationMessage.email.invalid})
  public email: string;

  @IsMimeType({message: UserValidationMessage.avatar.invalid})
  public avatar?: string;

  @MinLength(1, {message: UserValidationMessage.name.minLength})
  @MaxLength(15, {message: UserValidationMessage.name.maxLength})
  public name: string;

  @IsEnum(UserType, {message: UserValidationMessage.type.invalid})
  public type: UserType;

  @MinLength(6, {message: UserValidationMessage.password.minLength})
  @MaxLength(12, {message: UserValidationMessage.password.maxLength})
  public password: string;
}
