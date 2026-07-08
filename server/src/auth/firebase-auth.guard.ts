import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Auth } from 'firebase-admin/auth';
import { FIREBASE_AUTH } from '../firebase/firebase.constants';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './role.enum';

export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    role: Role;
  };
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: Auth,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: Record<string, string> }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const idToken = authHeader.slice('Bearer '.length).trim();

    let decoded;
    try {
      decoded = await this.firebaseAuth.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const role = decoded.role as Role | undefined;
    if (!role) {
      throw new UnauthorizedException('Token missing role claim');
    }

    request.user = { uid: decoded.uid, role };

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(role)
    ) {
      throw new UnauthorizedException('Insufficient role');
    }

    return true;
  }
}
