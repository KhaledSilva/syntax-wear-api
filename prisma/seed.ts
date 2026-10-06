import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const categories = [
	{
		name: "Camisetas",
		slug: "camisetas",
		description: "Camisetas casuais e estilosas para o dia a dia.",
		active: true,
	},
	{
		name: "Moletons",
		slug: "moletons",
		description: "Moletons confortáveis para dias mais frios.",
		active: true,
	},
	{
		name: "Calças",
		slug: "calcas",
		description: "Calças modernas para diferentes estilos.",
		active: true,
	},
	{
		name: "Jaquetas",
		slug: "jaquetas",
		description: "Jaquetas leves e resistentes.",
		active: true,
	},
	{
		name: "Shorts",
		slug: "shorts",
		description: "Shorts confortáveis para momentos casuais.",
		active: true,
	},
	{
		name: "Bonés",
		slug: "bones",
		description: "Bonés para complementar diferentes looks.",
		active: true,
	},
	{
		name: "Acessórios",
		slug: "acessorios",
		description: "Acessórios para completar seu estilo.",
		active: true,
	},
];

const products = [
	{
		name: "Camiseta Urban Code",
		slug: "camiseta-urban-code",
		description:
			"Camiseta de algodão com modelagem confortável e estampa minimalista.",
		price: 79.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Branco", "Cinza"],
		stock: 35,
		active: true,
		categorySlug: "camisetas",
	},
	{
		name: "Camiseta Dark Mode",
		slug: "camiseta-dark-mode",
		description:
			"Camiseta preta com visual moderno e acabamento confortável.",
		price: 89.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Verde"],
		stock: 28,
		active: true,
		categorySlug: "camisetas",
	},
	{
		name: "Camiseta Minimal",
		slug: "camiseta-minimal",
		description:
			"Camiseta básica com design minimalista para diferentes ocasiões.",
		price: 69.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Branco", "Azul", "Preto"],
		stock: 42,
		active: true,
		categorySlug: "camisetas",
	},
	{
		name: "Moletom Dev Club",
		slug: "moletom-dev-club",
		description:
			"Moletom confortável com capuz e bolso frontal.",
		price: 189.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza"],
		stock: 20,
		active: true,
		categorySlug: "moletons",
	},
	{
		name: "Moletom Night Shift",
		slug: "moletom-night-shift",
		description:
			"Moletom pesado e confortável para os dias mais frios.",
		price: 219.9,
		images: [],
		sizes: ["M", "G", "GG"],
		colors: ["Preto", "Marrom"],
		stock: 15,
		active: true,
		categorySlug: "moletons",
	},
	{
		name: "Calça Cargo Tech",
		slug: "calca-cargo-tech",
		description:
			"Calça cargo com bolsos laterais e tecido resistente.",
		price: 199.9,
		images: [],
		sizes: ["36", "38", "40", "42", "44"],
		colors: ["Preto", "Verde Militar"],
		stock: 18,
		active: true,
		categorySlug: "calcas",
	},
	{
		name: "Calça Jogger Essential",
		slug: "calca-jogger-essential",
		description:
			"Calça jogger confortável para um visual casual.",
		price: 159.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza"],
		stock: 25,
		active: true,
		categorySlug: "calcas",
	},
	{
		name: "Jaqueta Explorer",
		slug: "jaqueta-explorer",
		description:
			"Jaqueta leve para dias frios e atividades ao ar livre.",
		price: 279.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Azul-marinho"],
		stock: 12,
		active: true,
		categorySlug: "jaquetas",
	},
	{
		name: "Jaqueta Street",
		slug: "jaqueta-street",
		description:
			"Jaqueta urbana com fechamento em zíper e design moderno.",
		price: 249.9,
		images: [],
		sizes: ["M", "G", "GG"],
		colors: ["Preto", "Bege"],
		stock: 10,
		active: true,
		categorySlug: "jaquetas",
	},
	{
		name: "Shorts Performance",
		slug: "shorts-performance",
		description:
			"Shorts leve e confortável para atividades físicas.",
		price: 99.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Preto", "Cinza"],
		stock: 30,
		active: true,
		categorySlug: "shorts",
	},
	{
		name: "Shorts Casual",
		slug: "shorts-casual",
		description:
			"Shorts casual com tecido leve para o dia a dia.",
		price: 89.9,
		images: [],
		sizes: ["P", "M", "G", "GG"],
		colors: ["Bege", "Preto", "Verde"],
		stock: 22,
		active: true,
		categorySlug: "shorts",
	},
	{
		name: "Boné Classic",
		slug: "bone-classic",
		description:
			"Boné clássico com ajuste traseiro e logo frontal.",
		price: 59.9,
		images: [],
		sizes: ["Único"],
		colors: ["Preto", "Branco"],
		stock: 40,
		active: true,
		categorySlug: "bones",
	},
	{
		name: "Boné Street",
		slug: "bone-street",
		description:
			"Boné urbano com visual moderno e fechamento ajustável.",
		price: 69.9,
		images: [],
		sizes: ["Único"],
		colors: ["Preto", "Verde"],
		stock: 25,
		active: true,
		categorySlug: "bones",
	},
	{
		name: "Meias Everyday",
		slug: "meias-everyday",
		description:
			"Kit com três pares de meias confortáveis para o dia a dia.",
		price: 39.9,
		images: [],
		sizes: ["Único"],
		colors: ["Preto", "Branco", "Cinza"],
		stock: 60,
		active: true,
		categorySlug: "acessorios",
	},
];

const seedOrderMarker = "syntax-wear-orders-seed-v1";

const seedOrderAddress = {
	cep: "01001000",
	street: "Praça da Sé",
	number: "100",
	complement: seedOrderMarker,
	neighborhood: "Sé",
	city: "São Paulo",
	state: "SP",
	country: "Brasil",
};

const seedOrderItems = [
	{ productSlug: "camiseta-urban-code", quantity: 2 },
	{ productSlug: "bone-classic", quantity: 1 },
];

const hasSeedOrderMarker = (address: Prisma.JsonValue) =>
	typeof address === "object" &&
	address !== null &&
	!Array.isArray(address) &&
	address.complement === seedOrderMarker;

async function main() {
	console.log("🌱 Iniciando seed...");

	// 1. Criar categorias
	for (const category of categories) {
		await prisma.category.upsert({
			where: {
				slug: category.slug,
			},
			update: {
				name: category.name,
				description: category.description,
				active: category.active,
			},
			create: category,
		});
	}

	console.log(`✅ ${categories.length} categorias criadas/atualizadas.`);

	// 2. Criar produtos
	for (const product of products) {
		const category = await prisma.category.findUnique({
			where: {
				slug: product.categorySlug,
			},
		});

		if (!category) {
			throw new Error(
				`Categoria "${product.categorySlug}" não encontrada.`
			);
		}

		const { categorySlug, ...productData } = product;

		await prisma.product.upsert({
			where: {
				slug: product.slug,
			},
			update: {
				...productData,
				categoryId: category.id,
			},
			create: {
				...productData,
				categoryId: category.id,
			},
		});
	}

	console.log(`✅ ${products.length} produtos criados/atualizados.`);

	// 3. Criar ou atualizar um pedido de demonstração e seus itens
	const user = await prisma.user.findFirst({
		orderBy: { id: "asc" },
		select: { id: true, email: true },
	});

	if (!user) {
		console.warn(
			"⚠️ Nenhum usuário encontrado; pedido de demonstração não foi criado. Cadastre um usuário e execute o seed novamente.",
		);
		return;
	}

	const seededProducts = await prisma.product.findMany({
		where: {
			slug: { in: seedOrderItems.map(({ productSlug }) => productSlug) },
		},
		select: { id: true, name: true, slug: true, price: true },
	});
	const productsBySlug = new Map(
		seededProducts.map((product) => [product.slug, product]),
	);

	const orderItems = seedOrderItems.map(({ productSlug, quantity }) => {
		const product = productsBySlug.get(productSlug);

		if (!product) {
			throw new Error(
				`Produto "${productSlug}" não encontrado para criar o pedido de demonstração.`,
			);
		}

		return {
			productId: product.id,
			productName: product.name,
			unitPrice: product.price,
			quantity,
		};
	});

	const total = orderItems.reduce(
		(sum, item) => sum.plus(item.unitPrice.mul(item.quantity)),
		new Prisma.Decimal(0),
	);

	const seededOrder = await prisma.$transaction(async (transaction) => {
		const userOrders = await transaction.order.findMany({
			where: { userId: user.id },
			select: { id: true, shippingAddress: true },
		});
		const existingSeedOrder = userOrders.find(({ shippingAddress }) =>
			hasSeedOrderMarker(shippingAddress),
		);

		if (existingSeedOrder) {
			await transaction.orderItem.deleteMany({
				where: { orderId: existingSeedOrder.id },
			});

			return transaction.order.update({
				where: { id: existingSeedOrder.id },
				data: {
					total,
					status: "PENDING",
					shippingAddress: seedOrderAddress,
					paymentMethod: "PIX",
					items: { create: orderItems },
				},
				include: { items: true },
			});
		}

		return transaction.order.create({
			data: {
				userId: user.id,
				total,
				status: "PENDING",
				shippingAddress: seedOrderAddress,
				paymentMethod: "PIX",
				items: { create: orderItems },
			},
			include: { items: true },
		});
	});

	console.log(
		`✅ Pedido de demonstração ${seededOrder.id} criado/atualizado para ${user.email} com ${seededOrder.items.length} itens.`,
	);
	console.log("🌱 Seed executado com sucesso!");
}

main()
	.catch((error: unknown) => {
		console.error("❌ Erro ao executar seed:");
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
