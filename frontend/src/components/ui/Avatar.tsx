import React, { useState } from 'react'

interface AvatarProps {
  src?: string | null
  firstName?: string
  lastName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const getProxyUrl = (url: string | null | undefined): string => {
  if (!url) return ''

  // If it's already a relative path or local path, return it
  if (!url.startsWith('http')) return url

  // If it's a presigned URL (contains Signature or Expires query params), it is already signed, return it
  if (url.includes('X-Amz-Signature') || url.includes('Signature=')) {
    return url
  }

  // Extract the S3 key
  let key = ''
  const bucketName = 'pms-documents-2026'

  const bucketIdx = url.indexOf('/' + bucketName + '/')
  if (bucketIdx !== -1) {
    key = url.substring(bucketIdx + bucketName.length + 2)
  } else {
    // try amazonaws.com
    const awsIdx = url.indexOf('.amazonaws.com/')
    if (awsIdx !== -1) {
      key = url.substring(awsIdx + '.amazonaws.com/'.length)
    }
  }

  if (key) {
    const apiBase = (import.meta as any).env.VITE_API_URL || 'http://localhost:8080/api'
    const cleanApiBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase
    return `${cleanApiBase}/public/avatar?key=${encodeURIComponent(key)}`
  }

  return url
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  firstName = '',
  lastName = '',
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false)

  // Determine size classes
  let sizeClasses = 'w-10 h-10 text-sm'
  let textClasses = 'font-semibold'

  if (size === 'xs') {
    sizeClasses = 'w-5 h-5 text-[10px]'
    textClasses = 'font-bold'
  } else if (size === 'sm') {
    sizeClasses = 'w-8 h-8 text-xs'
    textClasses = 'font-medium'
  } else if (size === 'md') {
    sizeClasses = 'w-10 h-10 text-sm'
    textClasses = 'font-medium'
  } else if (size === 'lg') {
    sizeClasses = 'w-16 h-16 text-xl'
    textClasses = 'font-bold'
  } else if (size === 'xl') {
    sizeClasses = 'w-24 h-24 text-2xl'
    textClasses = 'font-bold'
  }

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()

  const proxySrc = getProxyUrl(src)

  if (proxySrc && !hasError) {
    return (
      <img
        src={proxySrc}
        alt={`${firstName} ${lastName}`}
        onError={() => setHasError(true)}
        className={`${sizeClasses} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-brand-100 dark:bg-gray-700 text-brand-700 dark:text-white flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      <span className={`${textClasses} leading-none`}>
        {initials || '?'}
      </span>
    </div>
  )
}

