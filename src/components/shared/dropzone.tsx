import {
  ActionIcon,
  Box,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { File, Image, Upload, X } from 'lucide-react'

import TextWithIcon from './text-icon'

import type { DropzoneProps, FileWithPath } from '@mantine/dropzone'

type Props = Partial<DropzoneProps> & {
  files: Array<FileWithPath>
  accept: Array<string>
  onDrop: (files: Array<FileWithPath>) => void
  onRemove?: (index: number) => void
}

export function DropzoneInput(props: Props) {
  const { files, onDrop, onRemove, ...rest } = props
  return (
    <Box>
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
          onDrop(fs)
        }}
        onReject={(fs) => console.log('rejected files', fs)}
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
              Suelta tus archivos XML aquí o haz click para seleccionar
            </Text>
            <Text inline c="dimmed" mt={7} size="sm">
              Adjunta tantos archivos como quieras, cada archivo no debe exceder
              los 5mb
            </Text>
            <Text inline c="dimmed" mt={7} size="sm">
              El número máximo de archivos que puedes subir es{' '}
              {rest.maxFiles || 'ilimitado'}
            </Text>
          </div>
        </Group>
      </Dropzone>
      <Box mt="lg">
        <Text mb="xs" size="sm">
          Archivos adjuntos ({files.length})
        </Text>
        <SimpleGrid cols={4}>
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
    </Box>
  )
}
