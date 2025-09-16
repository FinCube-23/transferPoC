export interface ContractAddresses {
    finCube: string;
    finCubeDAO: string;
    fincubeERC20: string; // renamed properly
    mockERC20: string;
}

export const contractAddresses: ContractAddresses = {
    finCube: import.meta.env.VITE_FIN_CUBE_ADDRESS,
    finCubeDAO: import.meta.env.VITE_FIN_CUBE_DAO_ADDRESS,
    fincubeERC20: import.meta.env.VITE_FINCUBE_ERC20_ADDRESS, // updated
    mockERC20: import.meta.env.VITE_MOCK_ERC20_ADDRESS
};
