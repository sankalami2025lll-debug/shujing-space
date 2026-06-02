/**
 * 模块：ContactModule
 * 用途：装配联系我们接口 /api/contact/*（提交线索 + 表单选项）。
 * 说明：
 *  - 两接口均为公开接口（游客可访问），无需 import AuthModule。
 *  - 依赖全局 PrismaModule（已 isGlobal），无需重复 import。
 */
import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
