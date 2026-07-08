import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'tri-heal-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
