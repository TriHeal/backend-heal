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
  isAvailable: boolean;
}

@Injectable()
export class ActivitiesService {
  private readonly catalog: ActivityCatalogItem[] = [
    {
      type: 'breathing',
      displayName: 'Breathing Exercise',
      isAvailable: true,
    },
    {
      type: 'event_decomposition',
      displayName: 'Event Decomposition',
      isAvailable: true,
    },
    {
      type: 'memory_book',
      displayName: 'Memory Book',
      isAvailable: true,
    },
    {
      type: 'tree_forest',
      displayName: 'Tree Forest',
      isAvailable: true,
    },
    {
      type: 'leaf_on_water',
      displayName: 'Leaf on Water',
      isAvailable: false,
    },
  ];

  findCatalog(): ActivityCatalogItem[] {
    return this.catalog;
  }
}
