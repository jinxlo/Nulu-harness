import { Context } from '@worldapptechnologies/cordis'
import { SettingsSchemaService } from '@worldapptechnologies/nulu-client-ui-settings/src/client/schema.ts'
import { createSettingsSchemaOperations } from '../src/client/schema-operations.ts'

/** Stateless schema operations used by settings-model component fixtures. */
export const settingsSchema = createSettingsSchemaOperations(new SettingsSchemaService(new Context()))
