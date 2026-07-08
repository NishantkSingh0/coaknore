import clsx from 'clsx'
import type {
  ProjectStatus, TaskStatus, IssueStatus, ReworkStatus,
  MaterialRequestStatus, QueryStatus
} from '../../types'
import {
  projectStatusColor, projectStatusLabel,
  taskStatusColor, taskStatusLabel,
  issueStatusColor, reworkStatusColor,
  matStatusColor, queryStatusColor
} from '../../utils/helpers'

export const ProjectBadge = ({ status }: { status: ProjectStatus }) => (
  <span className={clsx(projectStatusColor[status])}>
    {projectStatusLabel[status]}
  </span>
)

export const TaskBadge = ({ status }: { status: TaskStatus }) => (
  <span className={clsx(taskStatusColor[status])}>
    {taskStatusLabel[status]}
  </span>
)

export const IssueBadge = ({ status }: { status: IssueStatus }) => (
  <span className={clsx(issueStatusColor[status])}>
    {status.replace(/_/g, ' ')}
  </span>
)

export const ReworkBadge = ({ status }: { status: ReworkStatus }) => (
  <span className={clsx(reworkStatusColor[status])}>
    {status.replace(/_/g, ' ')}
  </span>
)

export const MatBadge = ({ status }: { status: MaterialRequestStatus }) => (
  <span className={clsx(matStatusColor[status])}>
    {status}
  </span>
)

export const QueryBadge = ({ status }: { status: QueryStatus }) => (
  <span className={clsx(queryStatusColor[status])}>
    {status.replace(/_/g, ' ')}
  </span>
)
