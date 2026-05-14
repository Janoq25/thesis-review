import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mínimo 8 caracteres' })
  @MaxLength(72)
  password: string;
}

// apps/api/src/auth/dto/register.dto.ts
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

// apps/api/src/auth/dto/refresh.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
