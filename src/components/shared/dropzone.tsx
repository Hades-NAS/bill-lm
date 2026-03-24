import {
  ActionIcon,
  Box,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Text,
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
        maxSize={5 * 1024 ** 2}
        onDrop={(fs) => {
          onDrop(fs)
        }}
        onReject={(fs) => console.log('rejected files', fs)}
        {...rest}
      >
        <Group
          gap="xl"
          justify="center"
          mih={220}
          style={{ pointerEvents: 'none' }}
        >
          <Dropzone.Accept>
            <Upload color="var(--mantine-color-violet-6)" size={52} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <X color="var(--mantine-color-red-6)" size={52} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <Image color="var(--mantine-color-dimmed)" size={52} />
          </Dropzone.Idle>

          <div>
            <Text inline c="gray.7" size="xl">
              Suelta tus archivos XML aquí o haz click para seleccionar
            </Text>
            <Text inline c="dimmed" mt={7} size="sm">
              Adjunta tantos archivos como quieras, cada archivo no debe exceder
              los 5mb
            </Text>
          </div>
        </Group>
      </Dropzone>
      <Box mt="lg">
        <Text mb="xs" size="sm">
          Selected files ({files.length})
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
