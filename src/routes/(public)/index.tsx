import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Box,
  Card,
  SimpleGrid,
  Badge,
  Center,
  Transition,
  ThemeIcon,
  List,
  Grid,
  useMantineColorScheme,
  Anchor,
  Flex,
} from '@mantine/core'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  FileText,
  Database,
  CheckCircle2,
  BarChart3,
  Clock,
  Shield,
  Users,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import React from 'react'

import { useIsMobile } from '#/utils/mobile'

import { useUserAuth } from '#/hooks/auth'

export const Route = createFileRoute('/(public)/')({
  ssr: true,
  component: App,
})

function App() {
  const { isSignedIn } = useUserAuth()
  const navigate = useNavigate()

  const [isVisible, setIsVisible] = React.useState(false)

  const isMobile = useIsMobile()

  const { colorScheme } = useMantineColorScheme()

  React.useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <Box bg="violet.6" min-h="100vh">
      {/* Hero Section */}
      <Transition
        duration={800}
        mounted={isVisible}
        timingFunction="cubic-bezier(0.2, 0, 0, 1)"
        transition="fade"
      >
        {(styles) => (
          <Container py={80} size="lg" style={styles}>
            <Stack gap={40}>
              {/* Hero Content */}
              <Stack align="center" gap={32}>
                <Group gap={8} justify="center">
                  <Badge
                    bd="1px solid white"
                    bg="white"
                    c="dark"
                    color="violet"
                    size="xl"
                    variant="dot"
                  >
                    Bill-LM
                  </Badge>
                </Group>

                <Stack align="center" gap={16}>
                  <Title
                    c="white"
                    fw={700}
                    order={1}
                    size={48}
                    style={{ lineHeight: 1.2 }}
                    ta="center"
                  >
                    Analiza tus facturas con el contexto fiscal que tú defines
                  </Title>

                  <Text c="white" maw={600} size="xl" ta="center">
                    Organiza tus facturas XML y analízalas con tu conexión de IA
                    y las referencias fiscales que agregas en Configuración. Es
                    una ayuda para revisar información; no sustituye asesoría
                    tributaria profesional.
                  </Text>
                </Stack>

                <Flex direction={isMobile ? 'column' : 'row'} gap={16}>
                  <Button
                    className="bill-lm-landing-button"
                    color="violet"
                    rightSection={<ArrowRight size={18} />}
                    size="lg"
                    variant="white"
                    onClick={() => {
                      navigate({ to: isSignedIn ? '/collections' : '/sign-up' })
                    }}
                  >
                    {isSignedIn ? 'Ver colecciones' : 'Crear cuenta gratis'}
                  </Button>
                  <Button
                    color="white"
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      const element = document.getElementById('como-funciona')
                      element?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    Cómo Funciona
                  </Button>
                </Flex>

                {/* Trust Badges */}
                <Group gap={32} justify="center" mt={32}>
                  <Group gap={8}>
                    <Shield color="white" size={20} />
                    <Text c="white" fw={500} size="sm">
                      Referencias que administras
                    </Text>
                  </Group>
                  <Group gap={8}>
                    <Clock color="white" size={20} />
                    <Text c="white" fw={500} size="sm">
                      Análisis basado en tu contexto
                    </Text>
                  </Group>
                  <Group gap={8}>
                    <Users color="white" size={20} />
                    <Text c="white" fw={500} size="sm">
                      Claves protegidas en el servidor
                    </Text>
                  </Group>
                </Group>
              </Stack>
            </Stack>
          </Container>
        )}
      </Transition>

      {/* How It Works Section */}
      <Box
        bg={colorScheme === 'dark' ? 'dark' : 'white'}
        id="como-funciona"
        py={80}
      >
        <Container size="lg">
          <Stack gap={60}>
            <Stack align="center" gap={16}>
              <Badge color="violet" size="xl" variant="light">
                Proceso Simplificado
              </Badge>
              <Title fw={700} order={2} size={36} ta="center">
                ¿Cómo Funciona Bill-LM?
              </Title>
              <Text c="dimmed" maw={600} size="lg" ta="center">
                Tres pasos para preparar el contexto y revisar tus facturas
              </Text>
            </Stack>

            <SimpleGrid
              cols={{ base: 1, sm: 2, md: 3 }}
              spacing={32}
              verticalSpacing={32}
            >
              {/* Step 1 */}
              <Transition
                duration={600}
                enterDelay={100}
                mounted={isVisible}
                transition="slide-up"
              >
                {() => (
                  <Card withBorder padding="lg" radius="md" shadow="sm">
                    <Stack gap={16}>
                      <Center>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={60}
                          variant="light"
                        >
                          <Database size={32} />
                        </ThemeIcon>
                      </Center>
                      <Stack align="center" gap={8}>
                        <Title order={4} size={18}>
                          1. Crea una colección
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                          Define el grupo de facturas que quieres revisar
                        </Text>
                      </Stack>
                    </Stack>
                  </Card>
                )}
              </Transition>

              {/* Step 2 */}
              <Transition
                duration={600}
                enterDelay={200}
                mounted={isVisible}
                transition="slide-up"
              >
                {() => (
                  <Card withBorder padding="lg" radius="md" shadow="sm">
                    <Stack gap={16}>
                      <Center>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={60}
                          variant="light"
                        >
                          <FileText size={32} />
                        </ThemeIcon>
                      </Center>
                      <Stack align="center" gap={8}>
                        <Title order={4} size={18}>
                          2. Sube tus facturas
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                          Carga tus archivos XML en la colección
                        </Text>
                      </Stack>
                    </Stack>
                  </Card>
                )}
              </Transition>

              {/* Step 3 */}
              <Transition
                duration={600}
                enterDelay={300}
                mounted={isVisible}
                transition="slide-up"
              >
                {() => (
                  <Card withBorder padding="lg" radius="md" shadow="sm">
                    <Stack gap={16}>
                      <Center>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={60}
                          variant="light"
                        >
                          <CheckCircle2 size={32} />
                        </ThemeIcon>
                      </Center>
                      <Stack align="center" gap={8}>
                        <Title order={4} size={18}>
                          3. Analiza con tu contexto
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                          Bill-LM usa la conexión y las referencias que
                          configuraste para generar un resultado de revisión
                        </Text>
                      </Stack>
                    </Stack>
                  </Card>
                )}
              </Transition>
            </SimpleGrid>

            {/* Detailed Process */}
            <Box mt={40}>
              <Grid gutter={40}>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap={24}>
                    <Stack gap={8}>
                      <Group gap={12}>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={32}
                          variant="light"
                        >
                          <Sparkles size={18} />
                        </ThemeIcon>
                        <Title order={4}>
                          Análisis con contexto configurable
                        </Title>
                      </Group>
                      <Text c="dimmed">
                        Procesa cada factura usando la conexión de IA y las
                        referencias fiscales que agregaste a tu cuenta.
                      </Text>
                    </Stack>

                    <Stack gap={8}>
                      <Group gap={12}>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={32}
                          variant="light"
                        >
                          <BarChart3 size={18} />
                        </ThemeIcon>
                        <Title order={4}>Resultados Claros</Title>
                      </Group>
                      <Text c="dimmed">
                        Recibe una clasificación y el razonamiento que generó el
                        análisis para revisar cada factura.
                      </Text>
                    </Stack>

                    <Stack gap={8}>
                      <Group gap={12}>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={32}
                          variant="light"
                        >
                          <Clock size={18} />
                        </ThemeIcon>
                        <Title order={4}>Proceso en Tiempo Real</Title>
                      </Group>
                      <Text c="dimmed">
                        Monitorea el progreso de tu análisis en tiempo real.
                        Recibe actualizaciones mientras procesamos tus facturas
                      </Text>
                    </Stack>
                  </Stack>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card
                    bg={colorScheme === 'dark' ? 'violet.9' : 'violet.1'}
                    padding="xl"
                    radius="md"
                    shadow="sm"
                  >
                    <Stack gap={16}>
                      <Group gap={8}>
                        <ThemeIcon
                          color="violet"
                          radius="md"
                          size={32}
                          variant="transparent"
                        >
                          <CheckCircle2 size={24} />
                        </ThemeIcon>
                        <Title
                          c={colorScheme === 'dark' ? 'white' : 'black'}
                          order={4}
                        >
                          ¿Qué obtienes?
                        </Title>
                      </Group>

                      <List
                        icon={
                          <ThemeIcon
                            color="violet"
                            radius="md"
                            variant="transparent"
                          >
                            <ArrowRight size={16} />
                          </ThemeIcon>
                        }
                        size="sm"
                        spacing={12}
                      >
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Resultado del análisis</strong> para cada
                          factura
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Razonamiento detallado</strong> del análisis
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Conexión y referencias</strong> que configuras
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Progreso</strong> mientras se procesan tus
                          facturas
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Una ayuda de revisión</strong>, no asesoría
                          tributaria profesional
                        </List.Item>
                      </List>
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Box bg="violet.6" py={80}>
        <Container size="lg">
          <Stack gap={60}>
            <Stack align="center" gap={16}>
              <Badge color="white" size="xl" variant="light">
                Para Ti
              </Badge>
              <Title c="white" fw={700} order={2} size={36} ta="center">
                Para personas y equipos
              </Title>
            </Stack>

            <Grid gutter={40}>
              {/* Personas Naturales */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Transition
                  duration={600}
                  enterDelay={200}
                  mounted={isVisible}
                  transition="slide-right"
                >
                  {() => (
                    <Card
                      bg="violet.8"
                      c="white"
                      padding="xl"
                      radius="md"
                      shadow="lg"
                    >
                      <Stack gap={20}>
                        <Group gap={12}>
                          <ThemeIcon
                            color="white"
                            radius="md"
                            size={40}
                            variant="light"
                          >
                            <Users size={24} />
                          </ThemeIcon>
                          <Title c="white" order={3}>
                            Personas Naturales
                          </Title>
                        </Group>

                        <List
                          icon={<ArrowRight color="white" size={16} />}
                          spacing={12}
                        >
                          <List.Item>
                            Elimina la carga de análisis manual de facturas
                          </List.Item>
                          <List.Item>
                            Revisa tus facturas antes de preparar tu declaración
                          </List.Item>
                          <List.Item>
                            Conserva el razonamiento generado para cada factura
                          </List.Item>
                          <List.Item>
                            Ahorra horas de revisión cada año fiscal
                          </List.Item>
                        </List>
                      </Stack>
                    </Card>
                  )}
                </Transition>
              </Grid.Col>

              {/* Contadores */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Transition
                  duration={600}
                  enterDelay={300}
                  mounted={isVisible}
                  transition="slide-left"
                >
                  {() => (
                    <Card
                      bg="violet.8"
                      c="white"
                      padding="xl"
                      radius="md"
                      shadow="lg"
                    >
                      <Stack gap={20}>
                        <Group gap={12}>
                          <ThemeIcon
                            color="white"
                            radius="md"
                            size={40}
                            variant="light"
                          >
                            <BarChart3 size={24} />
                          </ThemeIcon>
                          <Title c="white" order={3}>
                            Contadores Profesionales
                          </Title>
                        </Group>

                        <List
                          icon={<ArrowRight color="white" size={16} />}
                          spacing={12}
                        >
                          <List.Item>
                            Automatiza análisis en masa para múltiples clientes
                          </List.Item>
                          <List.Item>
                            Reduce tiempo en trabajo administrativo repetitivo
                          </List.Item>
                          <List.Item>
                            Revisa resultados junto con el contexto configurado
                          </List.Item>
                          <List.Item>
                            Mejora tu competitividad en el mercado
                          </List.Item>
                        </List>
                      </Stack>
                    </Card>
                  )}
                </Transition>
              </Grid.Col>
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box bg={colorScheme === 'dark' ? 'dark' : 'white'} pt={80}>
        <Container size="md">
          <Stack align="center" gap={32}>
            <Stack align="center" gap={16}>
              <Title
                c={colorScheme === 'dark' ? 'white' : 'black'}
                fw={700}
                order={2}
                size={36}
                ta="center"
              >
                {isSignedIn
                  ? 'Revisa tus colecciones'
                  : 'Empieza con tu contexto'}
              </Title>
              <Text c="dimmed" size="lg" ta="center">
                Crea tu cuenta, configura una conexión y agrega las referencias
                que usarás para revisar tus facturas.
              </Text>
            </Stack>

            <Group>
              <Button
                color="violet"
                rightSection={<ArrowRight size={18} />}
                size="lg"
                variant="filled"
                onClick={() => {
                  navigate({ to: isSignedIn ? '/collections' : '/sign-up' })
                }}
              >
                {isSignedIn ? 'Ver colecciones' : 'Crear cuenta gratis'}
              </Button>
            </Group>
          </Stack>
          <Box bg={colorScheme === 'dark' ? 'dark' : 'light'}>
            <Text c="dimmed" mt={80} size="xs" ta="center">
              Creado por{' '}
              <Anchor
                href="https://www.linkedin.com/in/enmanuelmag/"
                rel="noopener noreferrer"
                target="_blank"
              >
                <Text inherit c="violet.3" component="span" fw="bold">
                  Enmanuel Magallanes
                </Text>
              </Anchor>
            </Text>
            <Text c="dimmed" pb={40} pt={10} size="xs" ta="center">
              © 2026 Bill-LM. Todos los derechos reservados.
            </Text>
          </Box>
        </Container>
      </Box>
    </Box>
  )
}
