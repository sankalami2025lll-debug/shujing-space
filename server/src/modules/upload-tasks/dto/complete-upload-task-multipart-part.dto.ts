import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CompleteUploadTaskMultipartPartDto {
  @ApiProperty({
    description: '上传分片返回的 ETag',
    example: '"5B3C1A2E053D763E1B002CC607C5A0FE"',
  })
  @IsString({ message: 'etag 必须为字符串' })
  @IsNotEmpty({ message: 'etag 不能为空' })
  @MaxLength(255, { message: 'etag 长度不能超过 255' })
  etag!: string;

  @ApiProperty({
    description: '该分片实际大小（字节）',
    example: 33554432,
  })
  @Type(() => Number)
  @IsInt({ message: 'partSize 必须为整数' })
  @Min(1, { message: 'partSize 必须大于 0' })
  partSize!: number;
}
