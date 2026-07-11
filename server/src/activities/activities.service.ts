import { Injectable } from '@nestjs/common';

export type ActivityType =
  | 'breathing'
  | 'event_decomposition'
  | 'memory_book'
  | 'tree_forest'
  | 'leaf_on_water';

export interface ActivityCatalogItem {
  type: ActivityType;
  displayName: string;
  enabled: boolean;
}

@Injectable()
export class ActivitiesService {
  private readonly catalog: ActivityCatalogItem[] = [
    {
      type: 'breathing',
      displayName: 'Breathing Exercise',
      enabled: true,
    },
    {
      type: 'event_decomposition',
      displayName: 'Event Decomposition',
      enabled: true,
    },
    {
      type: 'memory_book',
      displayName: 'Memory Book',
      enabled: true,
    },
    {
      type: 'tree_forest',
      displayName: 'Tree Forest',
      enabled: true,
    },
    {
      type: 'leaf_on_water',
      displayName: 'Leaf on Water',
      enabled: false,
    },
  ];

  findCatalog(): ActivityCatalogItem[] {
    return this.catalog;
  }
}
