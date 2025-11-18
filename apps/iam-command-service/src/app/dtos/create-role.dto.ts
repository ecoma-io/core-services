import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
} from 'class-validator';

export class CreateRoleDto {
  @IsUUID()
  @IsNotEmpty()
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];

  @IsString()
  @IsOptional()
  description?: string;
}
