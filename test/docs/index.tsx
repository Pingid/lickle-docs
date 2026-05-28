import { create, type Types } from '@lickle/docs/preset'
import json from './docs.json'

create({ json: json as Types.ProjectJson })
