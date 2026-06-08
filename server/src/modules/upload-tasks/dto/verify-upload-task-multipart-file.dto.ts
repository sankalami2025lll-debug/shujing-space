import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class VerifyUploadTaskMultipartFileDto {
  @ApiProperty({ description: '原始文件名', example: 'large-model.glb' })
  @IsString({ message: 'fileName 必须为字符串' })
  @IsNotEmpty({ message: 'fileName 不能为空' })
  @MaxLength(255, { message: 'fileName 长度不能超过 255' })
  fileName!: string;

  @ApiProperty({ description: '文件大小（字节）', example: 73400320 })
  @Type(() => Number)
  @IsInt({ message: 'fileSize 必须为整数' })
  @Min(1, { message: 'fileSize 必须大于 0' })
  fileSize!: number;

  @ApiProperty({ description: '文件 lastModified（毫秒时间戳）', example: 1717766400000 })
  @Type(() => Number)
  @IsInt({ message: 'fileLastModified 必须为整数' })
  @Min(0, { message: 'fileLastModified 非法' })
  fileLastModified!: number;

  @ApiProperty({ description: '文件指纹算法', example: 'sample-sha256-v1' })
  @IsString({ message: 'fingerprintAlgo 必须为字符串' })
  @IsNotEmpty({ message: 'fingerprintAlgo 不能为空' })
  @MaxLength(40, { message: 'fingerprintAlgo 长度不能超过 40' })
  fingerprintAlgo!: string;

  @ApiProperty({ description: '文件指纹', example: 'f523d9...' })
  @IsString({ message: 'fingerprint 必须为字符串' })
  @IsNotEmpty({ message: 'fingerprint 不能为空' })
  @MaxLength(255, { message: 'fingerprint 长度不能超过 255' })
  fingerprint!: string;
}
