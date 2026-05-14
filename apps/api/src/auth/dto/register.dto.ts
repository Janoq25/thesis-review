import { IsEmail, IsString, IsIn, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe tener mayúsculas, minúsculas y números',
  })
  password: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @IsIn(['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'])
  role: string;

  @IsOptional()
  @IsString()
  programId?: string;
}
