// src/modules/onboarding/dto/create-onboarding.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingTaskDto {
    @IsString()
    @IsNotEmpty()
    label!: string;

    @IsString()
    @IsOptional()
    linkAction?: string;
}

export class CreateOnboardingDto {
    @IsInt()
    @IsNotEmpty()
    day!: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OnboardingTaskDto)
    tasks!: OnboardingTaskDto[];

    @IsString()
    @IsIn(['ONBOARDING', 'SPECIALIZATION'])
    @IsNotEmpty()
    type!: string;

    @IsString()
    @IsOptional()
    jobRole?: string;
}