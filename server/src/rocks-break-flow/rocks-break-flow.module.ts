import { Module } from '@nestjs/common';
import { RocksBreakFlowController } from './rocks-break-flow.controller';
import { RocksBreakFlowService } from './rocks-break-flow.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RocksBreakFlowController],
  providers: [RocksBreakFlowService],
})
export class RocksBreakFlowModule {}
