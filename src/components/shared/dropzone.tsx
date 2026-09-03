import {
  ActionIcon,
  Box,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { File, Image, Upload, X } from 'lucide-react'
import React from 'react'

import TextWithIcon from './text-icon'

import type { DropzoneProps, FileWithPath } from '@mantine/dropzone'

type Props = Partial<DropzoneProps> & {
  files: Array<FileWithPath>
  accept: Array<string>
  acceptedFileLabel?: string
  description?: string
  fileListLabel?: string
  onDrop: (files: Array<FileWithPath>) => void
  onRemove?: (index: number) => void
}

export function DropzoneInput(props: Props) {
  const {
    acceptedFileLabel = 'archivos',
    description,
    fileListLabel = 'Archivos adjuntos',
    files,
    onDrop,
    onRemove,
    ...rest
  } = props
  const [rejections, setRejections] = React.useState<
    Array<{ name: string; reason: string }>
  >([])
  const remainingFiles = rest.maxFiles ? rest.maxFiles - files.length : null

  return (
    <Stack gap="sm">
      <Dropzone
        {...rest}
        className={rest.disabled ? 'cursor-not-allowed!' : ''}
        maxFiles={
          rest.maxFiles && files.length
            ? rest.maxFiles - files.length
            : rest.maxFiles
        }
        maxSize={5 * 1024 ** 2}
        onDrop={(fs) => {
          setRejections([])
          onDrop(fs)
        }}
        onReject={(fs) =>
          setRejections(
            fs.map((rejection) => ({
              name: rejection.file.name,
              reason:
                rejection.errors[0]?.message ??
                'El archivo no cumple los requisitos de carga.',
            })),
          )
        }
      >
        <Group
          gap="xl"
          justify="center"
          mih={220}
          style={{ pointerEvents: 'none' }}
        >
          <Dropzone.Accept>
            <ThemeIcon color="violet.5" size={52} variant="transparent">
              <Upload size={52} />
            </ThemeIcon>
          </Dropzone.Accept>
          <Dropzone.Reject>
            <ThemeIcon color="red.5" size={52} variant="transparent">
              <X size={52} />
            </ThemeIcon>
          </Dropzone.Reject>
          <Dropzone.Idle>
            {rest.disabled && (
              <ThemeIcon color="gray" size={52} variant="transparent">
                <X size={52} />
              </ThemeIcon>
            )}
            {!rest.disabled && (
              <ThemeIcon color="gray" size={52} variant="transparent">
                <Image size={52} />
              </ThemeIcon>
            )}
          </Dropzone.Idle>

          <div>
            <Text inline c="gray" size="xl">
              Suelta tus {acceptedFileLabel} aquí o haz clic para seleccionar
            </Text>
            <Text inline c="dimmed" mt={7} size="sm">
              {description ??
                'Cada archivo puede pesar hasta 5 MB y debe cumplir el formato permitido.'}
            </Text>
            <Text inline c="dimmed" mt={7} size="sm">
              {rest.maxFiles
                ? `${files.length}/${rest.maxFiles} archivos seleccionados`
                : 'Sin límite de cantidad configurado'}
            </Text>
          </div>
        </Group>
      </Dropzone>
      {rejections.length > 0 && (
        <Stack gap={4}>
          {rejections.map((rejection) => (
            <Text c="red" key={`${rejection.name}-${rejection.reason}`} size="sm">
              {rejection.name}: {rejection.reason}
            </Text>
          ))}
        </Stack>
      )}
      <Box mt="lg">
        <Text mb="xs" size="sm">
          {fileListLabel} ({files.length}
          {remainingFiles !== null ? `/${rest.maxFiles}` : ''})
        </Text>
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          {files.map((file, index) => (
            <Paper withBorder key={index} p="sm" pos="relative">
              <Flex>
                <TextWithIcon>
                  <TextWithIcon.Icon color="black" size="xs">
                    <File size={32} />
                  </TextWithIcon.Icon>
                  <TextWithIcon.Text c="gray.7" lineClamp={1} size="sm">
                    {file.name}
                  </TextWithIcon.Text>
                </TextWithIcon>
              </Flex>
              {onRemove && (
                <Box>
                  <ActionIcon
                    aria-label={`Quitar ${file.name}`}
                    color="red"
                    pos="absolute"
                    radius="xl"
                    right={-10}
                    size={22}
                    top={-10}
                    variant="filled"
                    onClick={() => {
                      onRemove(index)
                    }}
                  >
                    <X size={16} />
                  </ActionIcon>
                </Box>
              )}
            </Paper>
          ))}
        </SimpleGrid>
      </Box>
    </Stack>
  )
}
