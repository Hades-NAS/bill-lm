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

import { useUserAuth } from '#/hooks/auth'

export const Route = createFileRoute('/(public)/')({
  ssr: true,
  component: App,
})

function App() {
  const { isSignedIn } = useUserAuth()
  const navigate = useNavigate()

  const [isVisible, setIsVisible] = React.useState(false)

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
        timingFunction="ease"
        transition="fade"
      >
        {(styles) => (
          <Container py={80} size="lg" style={styles}>
            <Stack gap={40}>
              {/* Hero Content */}
              <Stack align="center" gap={32}>
                <Group gap={8} justify="center">
                  <ThemeIcon radius="md" size={40} variant="transparent">
                    <FileText color="white" size={24} />
                  </ThemeIcon>
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
                    Análisis Inteligente de Facturas para SRI Ecuador
                  </Title>

                  <Text c="white" maw={600} size="xl" ta="center">
                    Automatiza el análisis de tus facturas y determina qué
                    gastos son deducibles según la normativa actual del SRI.
                    Perfecto para contadores y personas naturales.
                  </Text>
                </Stack>

                <Group>
                  <Button
                    className="hover:-translate-y-2 hover:shadow-lg transition-all duration-200"
                    color="violet"
                    rightSection={<ArrowRight size={18} />}
                    size="lg"
                    variant="white"
                    onClick={() => {
                      navigate({ to: isSignedIn ? '/collections' : '/sign-up' })
                    }}
                  >
                    {isSignedIn ? 'Ver Colecciones' : 'Crear Cuenta Gratis'}
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
                </Group>

                {/* Trust Badges */}
                <Group gap={32} justify="center" mt={32}>
                  <Group gap={8}>
                    <Shield color="white" size={20} />
                    <Text
                      c="white"
                      className="hover:font-bold! transition-all duration-200 cursor-default"
                      fw={500}
                      size="sm"
                    >
                      Análisis SRI Actualizado
                    </Text>
                  </Group>
                  <Group gap={8}>
                    <Clock color="white" size={20} />
                    <Text
                      c="white"
                      className="hover:font-bold! transition-all duration-200 cursor-default"
                      fw={500}
                      size="sm"
                    >
                      Resultados en Minutos
                    </Text>
                  </Group>
                  <Group gap={8}>
                    <Users color="white" size={20} />
                    <Text
                      c="white"
                      className="hover:font-bold! transition-all duration-200 cursor-default"
                      fw={500}
                      size="sm"
                    >
                      Para Todos los Usuarios
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
                Tres pasos simples para analizar tus facturas y optimizar tu
                declaración de impuestos
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
                  <Card
                    withBorder
                    className="cursor-pointer transition-all duration-200 hover:-translate-y-2 hover:shadow-lg"
                    padding="lg"
                    radius="md"
                    shadow="sm"
                  >
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
                          1. Crear Colección
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                          Define una colección con nombre, descripción y año
                          fiscal
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
                  <Card
                    withBorder
                    className="cursor-pointer transition-all duration-200 hover:-translate-y-2 hover:shadow-lg"
                    padding="lg"
                    radius="md"
                    shadow="sm"
                  >
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
                          2. Subir Facturas
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
                  <Card
                    withBorder
                    className="cursor-pointer transition-all duration-200 hover:-translate-y-2 hover:shadow-lg"
                    padding="lg"
                    radius="md"
                    shadow="sm"
                  >
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
                          3. Analizar Automático
                        </Title>
                        <Text c="dimmed" size="sm" ta="center">
                          Nuestro IA analiza cada factura según normativa SRI
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
                        <Title order={4}>Análisis Inteligente</Title>
                      </Group>
                      <Text c="dimmed">
                        Procesa automáticamente cada factura analizando su
                        contenido contra la última normativa actualizada del SRI
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
                        Recibe un porcentaje de deducibilidad y la razón
                        específica por la cual esa factura es elegible o no
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
                          <strong>Porcentaje de deducibilidad</strong> para cada
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
                          <strong>Exportación</strong> de resultados
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Historial completo</strong> de análisis
                        </List.Item>
                        <List.Item
                          c={colorScheme === 'dark' ? 'white' : undefined}
                        >
                          <strong>Asesoría basada en SRI</strong> actualizada
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
                Beneficios Según tu Rol
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
                      className="cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-2xl"
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
                            Asegúrate de máxima deducibilidad en tu declaración
                          </List.Item>
                          <List.Item>
                            Conoce exactamente qué facturas son válidas
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
                      className="cursor-pointer transition-all duration-200 hover:-translate-y-1.5 hover:shadow-2xl"
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
                            Ofrece servicios más precisos a tus clientes
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
                {isSignedIn ? 'Explora tus Análisis' : 'Comienza Hoy Mismo'}
              </Title>
              <Text c="dimmed" size="lg" ta="center">
                Gratis. Sin tarjeta de crédito. Analiza tus primeras facturas
                ahora.
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
                {isSignedIn ? 'Ver Colecciones' : 'Crear Cuenta Gratis'}
              </Button>
            </Group>
          </Stack>
          <Box bg={colorScheme === 'dark' ? 'dark' : 'light'}>
            <Text c="dimmed" mt={80} size="xs" ta="center">
              Made with ❤️ by{' '}
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
