import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FIREBASE_APP,
  FIRESTORE,
  REALTIME_DB,
  FIREBASE_AUTH,
} from '../firebase/firebase.constants';
import { ParentAccountsModule } from './parent-accounts.module';
import { ParentAccountsService } from './parent-accounts.service';
import { ParentSessionsService } from './parent-sessions.service';
import { ParentSessionsController } from './parent-sessions.controller';
import { ParentEmailService } from './parent-email.service';
import { OtpModule } from '../auth/otp/otp.module';
import { OtpService } from '../auth/otp/otp.service';

/**
 * Runtime DI-graph check for the parent live-session flow. `nest build` only
 * type-checks; it cannot catch a missing module export or an unresolvable
 * cross-module provider. Booting these modules exercises exactly the wiring
 * this feature introduced:
 *   - ParentAccountsModule exports ParentAccountsService + registers the new
 *     ParentSessions controller/service.
 *   - OtpModule imports ParentAccountsModule and injects ParentAccountsService
 *     into OtpService.
 *
 * The real FirebaseModule is NOT imported: its value-level `firebase-admin/auth`
 * import pulls in jwks-rsa, which jest's default transform can't parse. A stub
 * @Global module supplies the same DI tokens instead.
 */
@Global()
@Module({
  providers: [
    { provide: FIREBASE_APP, useValue: { options: { projectId: 'test' } } },
    { provide: FIRESTORE, useValue: {} },
    { provide: REALTIME_DB, useValue: {} },
    { provide: FIREBASE_AUTH, useValue: {} },
  ],
  exports: [FIREBASE_APP, FIRESTORE, REALTIME_DB, FIREBASE_AUTH],
})
class StubFirebaseModule {}

describe('parent live-session flow wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [StubFirebaseModule, ParentAccountsModule, OtpModule],
    })
      // Avoid constructing the real Resend-backed email service.
      .overrideProvider(ParentEmailService)
      .useValue({ sendParentInvitationEmail: jest.fn() })
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves ParentAccountsService (exported from its module)', () => {
    expect(moduleRef.get(ParentAccountsService)).toBeDefined();
  });

  it('resolves the new ParentSessions controller + service', () => {
    expect(moduleRef.get(ParentSessionsService)).toBeDefined();
    expect(moduleRef.get(ParentSessionsController)).toBeDefined();
  });

  it('constructs OtpService with the cross-module ParentAccountsService injected', () => {
    // Would throw at compile() if the OtpModule -> ParentAccountsModule import
    // or the ParentAccountsService export were missing.
    expect(moduleRef.get(OtpService)).toBeDefined();
  });
});
