import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min } from 'class-validator';

export class PresignUploadTaskMultipartPartsDto {
  @ApiProperty({
    description: '需要预签名的 partNumber 列表',
    type: [Number],
    example: [1, 2, 3, 4],
  })
  @IsArray({ message: 'partNumbers 必须为数组' })
  @ArrayMinSize(1, { message: 'partNumbers 至少包含一个分片' })
  @ArrayMaxSize(100, { message: 'partNumbers 单次最多申请 100 个分片' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'partNumbers 中的值必须为整数' })
  @Min(1, { each: true, message: 'partNumbers 中的值必须大于 0' })
  partNumbers!: number[];
}
