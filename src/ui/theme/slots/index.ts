import { createSlot } from './slot.tsx'

import { Breadcrumb as DefaultBreadcrumb } from '../components/Breadcrumb.tsx'
import { References as DefaultReferences } from '../components/References.tsx'
import { PageHeader as DefaultPageHeader } from '../components/PageHeader.tsx'
import { Sidebar as DefaultSidebar } from '../components/Sidebar.tsx'
import { Header as DefaultHeader } from '../components/Header.tsx'
import { Layout as DefaultLayout } from '../components/Layout.tsx'
import { Source as DefaultSource } from '../components/Source.tsx'

export const Header = createSlot('header', DefaultHeader)
export const Sidebar = createSlot('sidebar', DefaultSidebar)
export const Layout = createSlot('layout', DefaultLayout)
export const Breadcrumb = createSlot('breadcrumb', DefaultBreadcrumb)
export const References = createSlot('references', DefaultReferences)
export const PageHeader = createSlot('pageHeader', DefaultPageHeader)
export const Source = createSlot('source', DefaultSource)
