import { createSlot } from './slot.js'

import { Breadcrumb as DefaultBreadcrumb } from '../components/Breadcrumb.js'
import { References as DefaultReferences } from '../components/References.js'
import { PageHeader as DefaultPageHeader } from '../components/PageHeader.js'
import { Sidebar as DefaultSidebar } from '../components/Sidebar.js'
import { Header as DefaultHeader } from '../components/Header.js'
import { Layout as DefaultLayout } from '../components/Layout.js'
import { Source as DefaultSource } from '../components/Source.js'

export const Header = createSlot('header', DefaultHeader)
export const Sidebar = createSlot('sidebar', DefaultSidebar)
export const Layout = createSlot('layout', DefaultLayout)
export const Breadcrumb = createSlot('breadcrumb', DefaultBreadcrumb)
export const References = createSlot('references', DefaultReferences)
export const PageHeader = createSlot('pageHeader', DefaultPageHeader)
export const Source = createSlot('source', DefaultSource)
