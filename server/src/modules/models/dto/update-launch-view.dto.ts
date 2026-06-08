import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MODEL_LAUNCH_VIEW_VERSION,
  MODEL_LAUNCH_VIEW_VIEWER_KINDS,
} from '../launch-view.contract';

class LaunchViewSnapshotDto {
  @ApiProperty({ example: [0, 2, 6], type: [Number] })
  @IsArray({ message: 'launchView.snapshot.position 必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: 'launchView.snapshot.position 必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: 'launchView.snapshot.position 必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: 'launchView.snapshot.position 必须全部为数字' },
  )
  position!: number[];

  @ApiProperty({ example: [0, 2, 0], type: [Number] })
  @IsArray({ message: 'launchView.snapshot.target 必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: 'launchView.snapshot.target 必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: 'launchView.snapshot.target 必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: 'launchView.snapshot.target 必须全部为数字' },
  )
  target!: number[];

  @ApiProperty({ example: [0, 1, 0], type: [Number] })
  @IsArray({ message: 'launchView.snapshot.up 必须为长度为 3 的数组' })
  @ArrayMinSize(3, { message: 'launchView.snapshot.up 必须为长度为 3 的数组' })
  @ArrayMaxSize(3, { message: 'launchView.snapshot.up 必须为长度为 3 的数组' })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { each: true, message: 'launchView.snapshot.up 必须全部为数字' },
  )
  up!: number[];

  @ApiProperty({ example: 0.1 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'launchView.snapshot.near 必须为数字' },
  )
  @Min(0, { message: 'launchView.snapshot.near 必须大于 0' })
  near!: number;

  @ApiProperty({ example: 5000 })
  @IsNumber(
    { allowInfinity: false, allowNaN: false },
    { message: 'launchView.snapshot.far 必须为数字' },
  )
  @Min(0, { message: 'launchView.snapshot.far 必须大于 0' })
  far!: number;
}

export class UpdateLaunchViewDto {
  @ApiProperty({ example: MODEL_LAUNCH_VIEW_VERSION })
  @IsInt({ message: 'launchView.version 必须为整数' })
  @Min(MODEL_LAUNCH_VIEW_VERSION, {
    message: `launchView.version 当前仅支持 ${MODEL_LAUNCH_VIEW_VERSION}`,
  })
  version!: number;

  @ApiProperty({ enum: MODEL_LAUNCH_VIEW_VIEWER_KINDS, example: 'lcc' })
  @IsIn(MODEL_LAUNCH_VIEW_VIEWER_KINDS, {
    message: `launchView.viewerKind 必须为 ${MODEL_LAUNCH_VIEW_VIEWER_KINDS.join('/')}`,
  })
  viewerKind!: string;

  @ApiProperty({ type: LaunchViewSnapshotDto })
  @ValidateNested()
  @Type(() => LaunchViewSnapshotDto)
  snapshot!: LaunchViewSnapshotDto;
}
