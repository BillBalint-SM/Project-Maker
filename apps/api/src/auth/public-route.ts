import { SetMetadata } from '@nestjs/common';

export const publicRouteMetadata = 'project-maker:public-route';
export const PublicRoute = () => SetMetadata(publicRouteMetadata, true);

export const customerPublicRouteMetadata = 'project-maker:customer-public-route';
export const CustomerPublicRoute = () => SetMetadata(customerPublicRouteMetadata, true);
